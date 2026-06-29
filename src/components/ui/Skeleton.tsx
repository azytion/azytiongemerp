import React from 'react';

export function Skeleton({ className, style, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={`skeleton ${className || ''}`}
            style={style}
            {...props}
        />
    )
}
