import React, { useEffect, useState } from 'react';
import Lottie from 'lottie-react';

interface LottieIconProps {
  url: string;
  className?: string;
  loop?: boolean;
  autoplay?: boolean;
}

const LottieIcon: React.FC<LottieIconProps> = ({
  url,
  className = "w-full h-full",
  loop = true,
  autoplay = true
}) => {
  const [animationData, setAnimationData] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(url)
      .then(response => {
        if (!response.ok) throw new Error('Failed to load');
        return response.json();
      })
      .then(data => setAnimationData(data))
      .catch(() => setError(true));
  }, [url]);

  if (error || !animationData) {
    return null;
  }

  return (
    <Lottie
      animationData={animationData}
      loop={loop}
      autoplay={autoplay}
      className={className}
    />
  );
};

export default LottieIcon;
