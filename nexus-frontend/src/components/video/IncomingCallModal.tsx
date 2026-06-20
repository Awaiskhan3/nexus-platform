import React from 'react';
import { Phone, PhoneOff } from 'lucide-react';
import type { IncomingCallInfo } from '../../hooks/useVideoCall';

interface Props {
  call: IncomingCallInfo;
  onAccept: () => void;
  onReject: () => void;
}

export const IncomingCallModal: React.FC<Props> = ({ call, onAccept, onReject }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
    <div className="bg-white rounded-2xl shadow-2xl p-8 w-80 text-center animate-pulse-once">
      <div className="w-20 h-20 rounded-full bg-primary-100 flex items-center justify-center mx-auto mb-4 text-3xl">
        {call.callerInfo.avatar ? (
          <img src={call.callerInfo.avatar} className="w-full h-full rounded-full object-cover" alt="" />
        ) : (
          <span className="font-bold text-primary-700">
            {call.callerInfo.name.charAt(0).toUpperCase()}
          </span>
        )}
      </div>
      <h3 className="text-lg font-semibold text-gray-900">{call.callerInfo.name}</h3>
      <p className="text-sm text-gray-500 mt-1 mb-6">Incoming video call…</p>
      <div className="flex justify-center gap-6">
        <button
          onClick={onReject}
          className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-colors"
          title="Reject"
        >
          <PhoneOff size={22} />
        </button>
        <button
          onClick={onAccept}
          className="w-14 h-14 rounded-full bg-green-500 hover:bg-green-600 text-white flex items-center justify-center transition-colors"
          title="Accept"
        >
          <Phone size={22} />
        </button>
      </div>
    </div>
  </div>
);
