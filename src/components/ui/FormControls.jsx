import React from 'react';

export const Input = React.forwardRef(({ label, error, ...props }, ref) => (
  <div className="mb-5">
    <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
    <input ref={ref} className={`w-full px-4 py-2.5 bg-white border ${error ? 'border-red-400' : 'border-gray-200'} rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all duration-200`} {...props} />
    {error && <p className="mt-1 text-xs text-red-500">{error.message}</p>}
  </div>
));

export const Select = React.forwardRef(({ label, error, children, ...props }, ref) => (
  <div className="mb-5">
    <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
    <select ref={ref} className={`w-full px-4 py-2.5 bg-white border ${error ? 'border-red-400' : 'border-gray-200'} rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all duration-200`} {...props}>{children}</select>
    {error && <p className="mt-1 text-xs text-red-500">{error.message}</p>}
  </div>
));

export const TextArea = React.forwardRef(({ label, error, ...props }, ref) => (
  <div className="mb-5">
    <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
    <textarea ref={ref} className={`w-full px-4 py-2.5 bg-white border ${error ? 'border-red-400' : 'border-gray-200'} rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all duration-200`} rows={3} {...props} />
    {error && <p className="mt-1 text-xs text-red-500">{error.message}</p>}
  </div>
));

/** Small helper line under a question: why we ask / what it changes. */
export const Hint = ({ children }) => <p className="text-xs text-gray-400 -mt-3 mb-5 leading-relaxed">{children}</p>;

/**
 * Tap-card choice (radio group) — big targets instead of a dropdown.
 * options: [[value, title, subtitle?], ...]. Works with react-hook-form register().
 */
export const Choice = React.forwardRef(({ label, error, options, optional, hint, cols = 1, name, ...props }, ref) => (
  <fieldset className="mb-6">
    <legend className="block text-sm font-medium text-gray-700 mb-1.5">
      {label}{optional && <span className="ml-2 text-[11px] font-normal text-gray-400 uppercase tracking-wide">optional</span>}
    </legend>
    {hint && <p className="text-xs text-gray-400 mb-2.5 leading-relaxed">{hint}</p>}
    <div className={`grid gap-2 ${cols === 2 ? 'grid-cols-2' : cols === 3 ? 'grid-cols-3' : cols === 4 ? 'grid-cols-4' : 'grid-cols-1'}`}>
      {options.map(([value, title, sub]) => (
        <label key={String(value)} className="ll-choice cursor-pointer">
          <input type="radio" value={value} name={name} ref={ref} className="sr-only" {...props} />
          <span className="ll-choice-box block rounded-xl border px-3.5 py-3">
            <span className="block text-sm font-medium">{title}</span>
            {sub && <span className="block text-xs mt-0.5 ll-choice-sub">{sub}</span>}
          </span>
        </label>
      ))}
    </div>
    {error && <p className="mt-1.5 text-xs text-red-500">{error.message}</p>}
  </fieldset>
));
