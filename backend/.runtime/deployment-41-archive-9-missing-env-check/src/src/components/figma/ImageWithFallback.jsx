import { useState } from "react";

export function ImageWithFallback({
  src,
  alt,
  className,
  fallbackSrc = "/placeholder.jpg",
}) {
  const [hasError, setHasError] = useState(false);

  const handleError = () => {
    setHasError(true);
  };

  return (
    <img
      src={hasError ? fallbackSrc : src}
      alt={alt}
      className={className}
      onError={handleError}
    />
  );
}
