import React, { createContext, useContext } from 'react';
import { useVideoCall } from '../hooks/useVideoCall';

type VideoCallContextType = ReturnType<typeof useVideoCall>;

const VideoCallContext = createContext<VideoCallContextType | undefined>(undefined);

export const VideoCallProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const videoCall = useVideoCall();
  return <VideoCallContext.Provider value={videoCall}>{children}</VideoCallContext.Provider>;
};

export const useVideoCallContext = (): VideoCallContextType => {
  const context = useContext(VideoCallContext);
  if (!context) {
    throw new Error('useVideoCallContext must be used within a VideoCallProvider');
  }
  return context;
};
