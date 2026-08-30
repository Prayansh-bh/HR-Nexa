import React, { useState, useMemo } from "react";
import { isImageSource, resolveAvatarUrl, extractInitials } from "../../utils/avatar";

export { isImageSource, resolveAvatarUrl, extractInitials };

export interface AvatarProps {
  src?: string | null;
  initials?: string | null;
  name?: string | null;
  id?: string | null;
  size?: number;
  className?: string;
  alt?: string;
}

export function Avatar({
  src,
  initials,
  name,
  id,
  size = 36,
  className = "",
  alt,
}: AvatarProps) {
  const [hasError, setHasError] = useState(false);

  // If `src` is explicitly provided or `initials` holds an image source
  const rawImageVal = src || (isImageSource(initials) ? initials : null);
  const resolvedUrl = useMemo(() => resolveAvatarUrl(rawImageVal, id), [rawImageVal, id]);

  const fallbackInitials = useMemo(() => extractInitials(name, initials), [name, initials]);

  const showImage = Boolean(resolvedUrl && !hasError);

  return (
    <div
      className={`grid shrink-0 place-items-center rounded-full btn-gradient font-bold overflow-hidden select-none text-white ${className}`}
      style={{ width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.38)) }}
      title={name || alt || undefined}
    >
      {showImage ? (
        <img
          src={resolvedUrl!}
          alt={alt || name || "Avatar"}
          className="h-full w-full object-cover rounded-full"
          onError={() => setHasError(true)}
          loading="lazy"
        />
      ) : (
        <span>{fallbackInitials}</span>
      )}
    </div>
  );
}
