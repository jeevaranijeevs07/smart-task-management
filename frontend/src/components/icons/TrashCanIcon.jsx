import React from 'react';

const TrashCanIcon = ({ size = 18, title = 'Delete', ...props }) => {
  const px = typeof size === 'number' ? size : 18;
  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 64 64"
      role="img"
      aria-label={title}
      {...props}
    >
      <title>{title}</title>
      <g fill="none" stroke="#1e3a8a" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 20h28" />
        <path d="M24 14h16" />
        <path d="M27 14c0-3 2-5 5-5s5 2 5 5" />
        <path d="M22 20l2 34c.2 3 2.7 5.5 5.8 5.5h4.2" />
        <path d="M42 20l-2 34c-.2 3-2.7 5.5-5.8 5.5H30" />
        <path d="M24 28v22" />
        <path d="M32 28v22" />
        <path d="M40 28v22" />
      </g>
      <path
        d="M23.5 22.5h17L39 54.5c-.1 1.5-1.4 2.7-2.9 2.7H27.9c-1.5 0-2.8-1.2-2.9-2.7L23.5 22.5z"
        fill="#bfdbfe"
        opacity="0.95"
      />
      <path
        d="M18.5 20.5h27"
        stroke="#1e3a8a"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
    </svg>
  );
};

export default TrashCanIcon;

