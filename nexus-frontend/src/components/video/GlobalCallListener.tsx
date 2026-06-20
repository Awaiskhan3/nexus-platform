import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useVideoCallContext } from '../../context/VideoCallContext';
import { IncomingCallModal } from './IncomingCallModal';
import { VideoCallRoom } from './VideoCallRoom';
import { getSocket } from '../../services/socket';

/**
 * Mount this once inside <Router> in App.tsx.
 * It listens for incoming calls globally and renders the modal + call room
 * without requiring the user to be on the /video route.
 */
export const GlobalCallListener: React.FC = () => {
  const navigate = useNavigate();
  const {
    localVideoRef,
    remoteVideoRef,
    status,
    audioEnabled,
    videoEnabled,
    incomingCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleAudio,
    toggleVideo,
  } = useVideoCallContext();

  useEffect(() => {
    const socket = getSocket();
    console.debug('[global] VideoCallListener mounted — socket id:', socket?.id, 'connected:', socket?.connected);
    const stored = localStorage.getItem('nexus_user');
    if (stored) console.debug('[global] current user:', JSON.parse(stored));
  }, []);

  const handleEnd = () => {
    endCall();
    navigate(-1);
  };

  return (
    <>
      {/* Incoming call toast/modal */}
      {incomingCall && status === 'incoming' && (
        <IncomingCallModal call={incomingCall} onAccept={acceptCall} onReject={rejectCall} />
      )}

      {/* Full-screen call room once call is active */}
      {['calling', 'connecting', 'connected', 'ended'].includes(status) && (
        <VideoCallRoom
          localVideoRef={localVideoRef}
          remoteVideoRef={remoteVideoRef}
          status={status}
          audioEnabled={audioEnabled}
          videoEnabled={videoEnabled}
          onToggleAudio={toggleAudio}
          onToggleVideo={toggleVideo}
          onEndCall={handleEnd}
        />
      )}
    </>
  );
};
