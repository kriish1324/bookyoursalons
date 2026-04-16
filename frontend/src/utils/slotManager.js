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
  const slotId = `${salonId}_${date}_${time}`;
  const slotRef = doc(db, 'slots', slotId);
  const bookingRef = doc(collection(db, 'bookings'));
  
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
    
    return { success: true, bookingId: result };
  } catch (error) {
    console.error('Booking transaction failed:', error);
    return { success: false, error: error.message };
  }
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
