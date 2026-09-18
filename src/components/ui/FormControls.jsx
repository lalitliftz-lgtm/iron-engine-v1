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
