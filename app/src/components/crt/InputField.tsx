import { cn } from '@/lib/utils';

interface InputFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export function InputField({ label, className, ...props }: InputFieldProps) {
  return (
    <div className="w-full">
      {label && (
        <label className="section-title block mb-1">{label}</label>
      )}
      <input
        className={cn(
          'w-full h-9 rounded-md bg-[rgba(255,223,0,0.08)] border border-[rgba(255,223,0,0.4)] text-[#FFDF00] caret-[#FFDF00] font-[family-name:var(--font-pixel)] text-[0.5rem] px-3 outline-none transition-all placeholder:text-[rgba(255,223,0,0.3)]',
          'focus:border-[#FFDF00] focus:shadow-[0_0_8px_rgba(255,223,0,0.3)]',
          className
        )}
        {...props}
      />
    </div>
  );
}
