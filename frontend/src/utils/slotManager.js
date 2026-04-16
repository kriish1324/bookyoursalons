import { db } from '../firebase';
import { collection, doc, runTransaction, query, where, getDocs, serverTimestamp } from 'firebase/firestore';

/**
 * Generate time slots based on salon hours
 */
export const generateSlots = (openingTime, closingTime, slotDuration = 30) => {
  const slots = [];
  const [openHour, openMin] = openingTime.split(':').map(Number);
  const [closeHour, closeMin] = closingTime.split(':').map(Number);
  
  let currentMinutes = openHour * 60 + openMin;
  const closeMinutes = closeHour * 60 + closeMin;
  
  while (currentMinutes < closeMinutes) {
    const hour = Math.floor(currentMinutes / 60);
    const minute = currentMinutes % 60;
    const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    slots.push(timeStr);
    currentMinutes += slotDuration;
  }
  
  return slots;
};

/**
 * Initialize slots for a salon and date (call once per day)
 */
export const initializeSlotsForDate = async (salonId, date, openingTime, closingTime) => {
  const slots = generateSlots(openingTime, closingTime);
  const slotsRef = collection(db, 'slots');
  
  const batch = [];
  for (const time of slots) {
    const slotId = `${salonId}_${date}_${time}`;
    batch.push({
      id: slotId,
      salonId,
      date,
      time,
      isBooked: false,
      createdAt: serverTimestamp()
    });
  }
  
  return batch;
};

/**
 * Book a slot with transaction (prevents double booking)
 */
export const bookSlotWithTransaction = async (salonId, date, time, bookingData) => {
  // Validation
  if (!salonId || !date || !time) {
    return { success: false, error: 'Missing required fields' };
  }
  if (!bookingData.customerPhone || !bookingData.salonName) {
    return { success: false, error: 'Invalid booking data' };
  }
  
  // Idempotency check - prevent duplicate bookings
  const existingBookingsQuery = query(
    collection(db, 'bookings'),
    where('customerPhone', '==', bookingData.customerPhone),
    where('salonId', '==', salonId),
    where('date', '==', date),
    where('slotTime', '==', time),
    where('status', 'in', ['pending', 'confirmed'])
  );
  
  const existingSnapshot = await getDocs(existingBookingsQuery);
  if (!existingSnapshot.empty) {
    const existing = existingSnapshot.docs[0].data();
    console.log('Duplicate booking prevented:', existing.bookingId);
    return { success: true, bookingId: existing.bookingId, duplicate: true };
  }
  
  const slotId = `${salonId}_${date}_${time}`;
  const slotRef = doc(db, 'slots', slotId);
  const bookingRef = doc(collection(db, 'bookings'));
  
  // Retry mechanism
  const maxRetries = 3;
  let lastError = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await runTransaction(db, async (transaction) => {
        const slotDoc = await transaction.get(slotRef);
        
        // Check if slot exists, create if not
        if (!slotDoc.exists()) {
          transaction.set(slotRef, {
            salonId,
            date,
            time,
            isBooked: true,
            bookedAt: serverTimestamp()
          });
        } else {
          // Check if already booked
          if (slotDoc.data().isBooked === true) {
            throw new Error('Slot already booked');
          }
          // Mark as booked
          transaction.update(slotRef, {
            isBooked: true,
            bookedAt: serverTimestamp()
          });
        }
        
        // Create booking
        transaction.set(bookingRef, {
          ...bookingData,
          bookingId: bookingRef.id,
          slotTime: time,
          date: date,
          status: 'pending',
          createdAt: serverTimestamp()
        });
        
        return bookingRef.id;
      });
      
      console.log('Booking created:', result);
      return { success: true, bookingId: result };
    } catch (error) {
      lastError = error;
      console.warn(`Booking attempt ${attempt} failed:`, error.message);
      
      if (error.message === 'Slot already booked') {
        return { success: false, error: 'Slot already booked' };
      }
      
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 300 * attempt));
      }
    }
  }
  
  console.error('Booking failed after retries:', lastError);
  return { success: false, error: lastError?.message || 'Booking failed' };
};

/**
 * Get available slots for a salon and date
 */
export const getAvailableSlots = async (salonId, date, openingTime, closingTime) => {
  const allSlots = generateSlots(openingTime, closingTime);
  const slotsRef = collection(db, 'slots');
  const q = query(
    slotsRef,
    where('salonId', '==', salonId),
    where('date', '==', date)
  );
  
  const snapshot = await getDocs(q);
  const bookedTimes = new Set();
  
  snapshot.forEach(doc => {
    if (doc.data().isBooked) {
      bookedTimes.add(doc.data().time);
    }
  });
  
  return allSlots.map(time => ({
    time,
    isAvailable: !bookedTimes.has(time)
  }));
};

/**
 * Release a slot (when booking is cancelled)
 */
export const releaseSlot = async (salonId, date, time) => {
  const slotId = `${salonId}_${date}_${time}`;
  const slotRef = doc(db, 'slots', slotId);
  
  try {
    await runTransaction(db, async (transaction) => {
      const slotDoc = await transaction.get(slotRef);
      if (slotDoc.exists()) {
        transaction.update(slotRef, {
          isBooked: false,
          releasedAt: serverTimestamp()
        });
      }
    });
    return true;
  } catch (error) {
    console.error('Release slot failed:', error);
    return false;
  }
};
