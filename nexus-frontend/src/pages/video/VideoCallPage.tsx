import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useVideoCallContext } from '../../context/VideoCallContext';
import { VideoCallRoom } from '../../components/video/VideoCallRoom';
import { IncomingCallModal } from '../../components/video/IncomingCallModal';

/**
 * Route: /video/:userId
 * Navigating here initiates a call to :userId.
 * The callee sees an IncomingCallModal from wherever they are in the app
 * (rendered in App.tsx via the global VideoCallProvider).
 */
export const VideoCallPage: React.FC = () => {
  const { userId: targetUserId } = useParams<{ userId: string }>();
  const navigate = useNavigate();

  const {
    localVideoRef,
    remoteVideoRef,
    status,
    audioEnabled,
    videoEnabled,
    incomingCall,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleAudio,
    toggleVideo,
  } = useVideoCallContext();

  // Kick off the call as soon as we land on this page
  useEffect(() => {
    if (targetUserId) {
      const storedUser = localStorage.getItem('nexus_user');
      const me = storedUser ? JSON.parse(storedUser) : { name: 'User' };
      startCall(targetUserId, { name: me.name, avatar: me.avatar });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetUserId]);

  const handleEnd = () => {
    endCall();
    navigate(-1);
  };

  return (
    <>
      {incomingCall && (
        <IncomingCallModal call={incomingCall} onAccept={acceptCall} onReject={rejectCall} />
      )}

      {status !== 'idle' && (
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
