import { Scissors } from 'lucide-react';

function Logo({ size = 'default', showText = true, className = '' }) {
  const sizes = {
    small: { icon: 'w-5 h-5', text: 'text-base', container: 'gap-1.5' },
    default: { icon: 'w-7 h-7', text: 'text-xl', container: 'gap-2' },
    large: { icon: 'w-10 h-10', text: 'text-3xl', container: 'gap-3' }
  };
  
  const s = sizes[size] || sizes.default;

  return (
    <div className={`flex items-center ${s.container} ${className}`}>
      <div className="relative">
        <div className="bg-gradient-to-br from-red-500 to-pink-600 p-1.5 sm:p-2 rounded-lg shadow-md">
          <Scissors className={`${s.icon} text-white`} />
        </div>
        <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-yellow-400 rounded-full"></div>
      </div>
      {showText && (
        <div className="flex flex-col leading-tight">
          <span className={`${s.text} font-bold bg-gradient-to-r from-red-600 to-pink-600 bg-clip-text text-transparent`}>
            BookYour<span className="text-gray-800">Salons</span>
          </span>
        </div>
      )}
    </div>
  );
}

export default Logo;
