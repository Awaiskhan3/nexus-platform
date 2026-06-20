import { useRef, useState, useCallback, useEffect } from 'react';
import { getSocket } from '../services/socket';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export type CallStatus =
  | 'idle'
  | 'calling'
  | 'incoming'
  | 'connecting'
  | 'connected'
  | 'ended';

export interface IncomingCallInfo {
  roomId: string;
  callerId: string;
  callerInfo: { name: string; avatar?: string };
}

export function useVideoCall() {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  const [status, setStatus] = useState<CallStatus>('idle');
  const [roomId, setRoomId] = useState<string | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [incomingCall, setIncomingCall] = useState<IncomingCallInfo | null>(null);

  // ─── Media ─────────────────────────────────────────────────────────────────

  const getLocalStream = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localStreamRef.current = stream;
    if (localVideoRef.current) localVideoRef.current.srcObject = stream;
    return stream;
  }, []);

  const stopLocalStream = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
  }, []);

  // ─── PeerConnection ────────────────────────────────────────────────────────

  const createPeer = useCallback((stream: MediaStream, currentRoomId: string) => {
    const socket = getSocket();
    if (!socket) return null;

    const peer = new RTCPeerConnection(ICE_SERVERS);
    peerRef.current = peer;

    stream.getTracks().forEach((track) => peer.addTrack(track, stream));

    peer.ontrack = (e) => {
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = e.streams[0];
    };

    peer.onicecandidate = (e) => {
      if (e.candidate) {
        socket.emit('call:ice_candidate', { roomId: currentRoomId, candidate: e.candidate });
      }
    };

    peer.onconnectionstatechange = () => {
      if (peer.connectionState === 'connected') setStatus('connected');
      if (['disconnected', 'failed', 'closed'].includes(peer.connectionState)) endCall();
    };

    return peer;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Initiate call ─────────────────────────────────────────────────────────

  const pendingCall = useRef<{ targetUserId: string; callerInfo: { name: string; avatar?: string } } | null>(null);

  const startCall = useCallback(
    async (targetUserId: string, callerInfo: { name: string; avatar?: string }) => {
      const socket = getSocket();
      if (!socket || !socket.connected) {
        console.warn('[video] startCall called before socket connected, queuing call');
        pendingCall.current = { targetUserId, callerInfo };
        return;
      }

      const newRoomId = `${socket.id}-${Date.now()}`;
      setRoomId(newRoomId);
      setStatus('calling');

      const stream = await getLocalStream();
      const peer = createPeer(stream, newRoomId);
      if (!peer) return;

      const handleAccepted = async ({ roomId: rid }: { roomId: string }) => {
        if (rid !== newRoomId) return;
        console.debug('[video] call accepted for', newRoomId);
        setStatus('connecting');
        socket.emit('call:join', { roomId: newRoomId }, async () => {
          const offer = await peer.createOffer();
          await peer.setLocalDescription(offer);
          socket.emit('call:offer', { roomId: newRoomId, offer });
        });
      };

      const handleRejected = ({ roomId: rid }: { roomId: string }) => {
        if (rid === newRoomId) {
          console.debug('[video] call rejected for', newRoomId);
          endCall();
        }
      };

      socket.once('call:accepted', handleAccepted);
      socket.once('call:rejected', handleRejected);
      socket.emit(
        'call:initiate',
        { targetUserId, roomId: newRoomId, callerInfo },
        (response: { success: boolean; message?: string }) => {
          if (!response?.success) {
            console.error('[video] call:initiate failed:', response?.message);
            endCall();
          }
        }
      );
    },
    [createPeer, getLocalStream] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // ─── Accept incoming call ──────────────────────────────────────────────────

  const acceptCall = useCallback(async () => {
    const socket = getSocket();
    if (!socket || !incomingCall) return;

    const { roomId: rid, callerId } = incomingCall;
    setRoomId(rid);
    setStatus('connecting');
    setIncomingCall(null);

    const stream = await getLocalStream();
    createPeer(stream, rid);

    socket.emit('call:join', { roomId: rid }, () => {
      console.debug('[video] joined call room as callee', rid);
      socket.emit('call:accept', { roomId: rid, callerId });
    });
  }, [incomingCall, createPeer, getLocalStream]);

  // ─── Reject incoming call ──────────────────────────────────────────────────

  const rejectCall = useCallback(() => {
    const socket = getSocket();
    if (!socket || !incomingCall) return;
    socket.emit('call:reject', { roomId: incomingCall.roomId, callerId: incomingCall.callerId });
    setIncomingCall(null);
    setStatus('idle');
  }, [incomingCall]);

  // ─── End call ──────────────────────────────────────────────────────────────

  const endCall = useCallback(() => {
    const socket = getSocket();
    if (socket && roomId) socket.emit('call:end', { roomId });
    peerRef.current?.close();
    peerRef.current = null;
    stopLocalStream();
    setStatus('ended');
    setRoomId(null);
    setTimeout(() => setStatus('idle'), 2000);
  }, [roomId, stopLocalStream]);

  // ─── Toggle audio / video ──────────────────────────────────────────────────

  const toggleAudio = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const enabled = !audioEnabled;
    stream.getAudioTracks().forEach((t) => (t.enabled = enabled));
    setAudioEnabled(enabled);
    const socket = getSocket();
    if (socket && roomId) socket.emit('call:toggle_media', { roomId, audio: enabled, video: videoEnabled });
  }, [audioEnabled, videoEnabled, roomId]);

  const toggleVideo = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const enabled = !videoEnabled;
    stream.getVideoTracks().forEach((t) => (t.enabled = enabled));
    setVideoEnabled(enabled);
    const socket = getSocket();
    if (socket && roomId) socket.emit('call:toggle_media', { roomId, audio: audioEnabled, video: enabled });
  }, [videoEnabled, audioEnabled, roomId]);

  // ─── Socket event listeners ────────────────────────────────────────────────

  useEffect(() => {
    let currentSocket = getSocket();
    let listenersAttached = false;

    const cleanup = () => {
      if (!currentSocket || !listenersAttached) return;
      currentSocket.off('call:incoming', onIncoming);
      currentSocket.off('call:offer', onOffer);
      currentSocket.off('call:answer', onAnswer);
      currentSocket.off('call:ice_candidate', onIceCandidate);
      currentSocket.off('call:ended', onCallEnded);
      listenersAttached = false;
    };

    const onIncoming = (data: IncomingCallInfo) => {
      console.debug('[video] incoming call', data);
      setIncomingCall(data);
      setStatus('incoming');
    };

    const onOffer = async ({ offer }: { offer: RTCSessionDescriptionInit }) => {
      const peer = peerRef.current;
      if (!peer || !roomId) return;
      await peer.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      const socket = getSocket();
      if (socket) socket.emit('call:answer', { roomId, answer });
    };

    const onAnswer = async ({ answer }: { answer: RTCSessionDescriptionInit }) => {
      const peer = peerRef.current;
      if (!peer) return;
      await peer.setRemoteDescription(new RTCSessionDescription(answer));
    };

    const onIceCandidate = async ({ candidate }: { candidate: RTCIceCandidateInit }) => {
      const peer = peerRef.current;
      if (!peer) return;
      await peer.addIceCandidate(new RTCIceCandidate(candidate));
    };

    const onCallEnded = () => {
      peerRef.current?.close();
      peerRef.current = null;
      stopLocalStream();
      setStatus('ended');
      setRoomId(null);
      setTimeout(() => setStatus('idle'), 2000);
    };

    const registerSocketListeners = () => {
      const socket = getSocket();
      if (!socket) return;
      if (socket === currentSocket && listenersAttached) return;
      cleanup();
      currentSocket = socket;
      socket.on('call:incoming', onIncoming);
      socket.on('call:offer', onOffer);
      socket.on('call:answer', onAnswer);
      socket.on('call:ice_candidate', onIceCandidate);
      socket.on('call:ended', onCallEnded);
      listenersAttached = true;
      console.debug('[video] socket listeners attached', { socketId: socket.id });
    };

    const onSocketConnected = () => {
      console.debug('[video] socket connected event received');
      registerSocketListeners();
    };

    registerSocketListeners();
    window.addEventListener('socket:connected', onSocketConnected);

    return () => {
      cleanup();
      window.removeEventListener('socket:connected', onSocketConnected);
    };
  }, [roomId, stopLocalStream]);

  useEffect(() => {
    const processPendingCall = () => {
      const socket = getSocket();
      if (!socket || !pendingCall.current) return;

      const { targetUserId, callerInfo } = pendingCall.current;
      pendingCall.current = null;
      startCall(targetUserId, callerInfo);
    };

    processPendingCall();
    window.addEventListener('socket:connected', processPendingCall);

    return () => {
      window.removeEventListener('socket:connected', processPendingCall);
    };
  }, [startCall]);

  return {
    localVideoRef,
    remoteVideoRef,
    status,
    roomId,
    audioEnabled,
    videoEnabled,
    incomingCall,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleAudio,
    toggleVideo,
  };
}
