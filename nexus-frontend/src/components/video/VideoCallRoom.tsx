import React from 'react';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Wifi } from 'lucide-react';
import type { CallStatus } from '../../hooks/useVideoCall';

interface Props {
  localVideoRef: React.RefObject<HTMLVideoElement>;
  remoteVideoRef: React.RefObject<HTMLVideoElement>;
  status: CallStatus;
  audioEnabled: boolean;
  videoEnabled: boolean;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onEndCall: () => void;
}

const statusLabel: Record<CallStatus, string> = {
  idle: '',
  calling: 'Calling…',
  incoming: 'Incoming…',
  connecting: 'Connecting…',
  connected: 'Connected',
  ended: 'Call Ended',
};

export const VideoCallRoom: React.FC<Props> = ({
  localVideoRef,
  remoteVideoRef,
  status,
  audioEnabled,
  videoEnabled,
  onToggleAudio,
  onToggleVideo,
  onEndCall,
}) => {
  return (
    <div className="fixed inset-0 z-40 bg-gray-950 flex flex-col">
      {/* Remote video (full screen) */}
      <div className="flex-1 relative">
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />

        {/* Status overlay when not yet connected */}
        {status !== 'connected' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/80">
            <Wifi size={40} className="text-primary-400 mb-4 animate-pulse" />
            <p className="text-white text-xl font-medium">{statusLabel[status]}</p>
          </div>
        )}

        {/* Local video pip */}
        <div className="absolute bottom-4 right-4 w-36 h-24 rounded-xl overflow-hidden border-2 border-white shadow-lg bg-gray-800">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          {!videoEnabled && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
              <VideoOff size={20} className="text-gray-400" />
            </div>
          )}
        </div>
      </div>

      {/* Controls bar */}
      <div className="h-24 bg-gray-900 flex items-center justify-center gap-5">
        <ControlBtn
          active={audioEnabled}
          activeIcon={<Mic size={22} />}
          inactiveIcon={<MicOff size={22} />}
          onClick={onToggleAudio}
          label={audioEnabled ? 'Mute' : 'Unmute'}
        />
        <ControlBtn
          active={videoEnabled}
          activeIcon={<Video size={22} />}
          inactiveIcon={<VideoOff size={22} />}
          onClick={onToggleVideo}
          label={videoEnabled ? 'Stop video' : 'Start video'}
        />
        <button
          onClick={onEndCall}
          className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center transition-colors"
          title="End call"
        >
          <PhoneOff size={22} />
        </button>
      </div>
    </div>
  );
};

// ─── Small helper ──────────────────────────────────────────────────────────────
interface CtrlProps {
  active: boolean;
  activeIcon: React.ReactNode;
  inactiveIcon: React.ReactNode;
  onClick: () => void;
  label: string;
}

const ControlBtn: React.FC<CtrlProps> = ({ active, activeIcon, inactiveIcon, onClick, label }) => (
  <button
    onClick={onClick}
    title={label}
    className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
      active
        ? 'bg-gray-700 hover:bg-gray-600 text-white'
        : 'bg-yellow-500 hover:bg-yellow-400 text-gray-900'
    }`}
  >
    {active ? activeIcon : inactiveIcon}
  </button>
);
