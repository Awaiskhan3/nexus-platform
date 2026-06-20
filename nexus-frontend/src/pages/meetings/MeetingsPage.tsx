import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Video, Phone, MapPin, Plus, Check, X, ChevronRight, User } from 'lucide-react';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { useAuth } from '../../context/AuthContext';
import { meetingsAPI, usersAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

interface Meeting {
  _id: string;
  title: string;
  description?: string;
  scheduledAt: string;
  duration: number;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled' | 'completed';
  meetingType: 'video_call' | 'phone_call' | 'in_person';
  meetingLink?: string;
  organizer: { _id: string; name: string; avatarUrl: string; role: string };
  attendee: { _id: string; name: string; avatarUrl: string; role: string };
  agenda?: string;
}

const statusColors: Record<string, 'success' | 'warning' | 'error' | 'default' | 'primary'> = {
  accepted: 'success',
  pending: 'warning',
  rejected: 'error',
  cancelled: 'error',
  completed: 'default',
};

const MeetingTypeIcon = ({ type }: { type: string }) => {
  if (type === 'video_call') return <Video size={16} className="text-blue-500" />;
  if (type === 'phone_call') return <Phone size={16} className="text-green-500" />;
  return <MapPin size={16} className="text-orange-500" />;
};

export const MeetingsPage: React.FC = () => {
  const { user } = useAuth();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'all'>('upcoming');
  const [users, setUsers] = useState<any[]>([]);

  // New meeting form
  const [form, setForm] = useState({
    attendeeId: '',
    title: '',
    description: '',
    scheduledAt: '',
    duration: 30,
    meetingType: 'video_call',
    agenda: '',
  });
  const [scheduling, setScheduling] = useState(false);

  useEffect(() => {
    loadMeetings();
    loadUsers();
  }, [activeTab]);

  const loadMeetings = async () => {
    try {
      setIsLoading(true);
      const params = activeTab === 'upcoming' ? { upcoming: 'true' } : {};
      const { data } = await meetingsAPI.getAll(params);
      setMeetings(data.data.meetings);
    } catch (error) {
      toast.error('Failed to load meetings');
    } finally {
      setIsLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      if (user?.role === 'investor') {
        const { data } = await usersAPI.getEntrepreneurs();
        setUsers(data.data.entrepreneurs);
      } else {
        const { data } = await usersAPI.getInvestors();
        setUsers(data.data.investors);
      }
    } catch (_) {}
  };

  const handleSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    setScheduling(true);
    try {
      await meetingsAPI.schedule({
        ...form,
        duration: Number(form.duration),
      });
      toast.success('Meeting scheduled successfully!');
      setShowScheduleModal(false);
      setForm({ attendeeId: '', title: '', description: '', scheduledAt: '', duration: 30, meetingType: 'video_call', agenda: '' });
      loadMeetings();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to schedule meeting');
    } finally {
      setScheduling(false);
    }
  };

  const handleRespond = async (meetingId: string, status: 'accepted' | 'rejected') => {
    try {
      await meetingsAPI.respond(meetingId, status);
      toast.success(`Meeting ${status}`);
      loadMeetings();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to respond');
    }
  };

  const handleCancel = async (meetingId: string) => {
    try {
      await meetingsAPI.cancel(meetingId);
      toast.success('Meeting cancelled');
      loadMeetings();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to cancel');
    }
  };

  const isOrganizer = (meeting: Meeting) => meeting.organizer._id === user?._id || meeting.organizer.id === user?.id;
  const isAttendee = (meeting: Meeting) => meeting.attendee._id === user?._id || meeting.attendee.id === user?.id;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Meetings</h1>
          <p className="text-gray-600">Schedule and manage your meetings</p>
        </div>
        <Button leftIcon={<Plus size={18} />} onClick={() => setShowScheduleModal(true)}>
          Schedule Meeting
        </Button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          {(['upcoming', 'all'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-3 px-1 border-b-2 text-sm font-medium capitalize transition-colors ${
                activeTab === tab
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab === 'upcoming' ? 'Upcoming' : 'All Meetings'}
            </button>
          ))}
        </nav>
      </div>

      {/* Meeting List */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      ) : meetings.length === 0 ? (
        <Card>
          <CardBody className="text-center py-12">
            <Calendar size={48} className="mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900">No meetings yet</h3>
            <p className="text-gray-500 mt-1">Schedule a meeting to get started</p>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-4">
          {meetings.map((meeting) => (
            <Card key={meeting._id} className="hover:shadow-md transition-shadow">
              <CardBody>
                <div className="flex items-start justify-between">
                  <div className="flex gap-4">
                    {/* Date block */}
                    <div className="flex-shrink-0 w-14 h-14 bg-primary-50 rounded-lg flex flex-col items-center justify-center">
                      <span className="text-xs font-medium text-primary-600 uppercase">
                        {format(new Date(meeting.scheduledAt), 'MMM')}
                      </span>
                      <span className="text-xl font-bold text-primary-700">
                        {format(new Date(meeting.scheduledAt), 'd')}
                      </span>
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900">{meeting.title}</h3>
                        <Badge variant={statusColors[meeting.status]}>{meeting.status}</Badge>
                      </div>

                      <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <Clock size={14} />
                          {format(new Date(meeting.scheduledAt), 'h:mm a')} · {meeting.duration}min
                        </span>
                        <span className="flex items-center gap-1">
                          <MeetingTypeIcon type={meeting.meetingType} />
                          {meeting.meetingType.replace('_', ' ')}
                        </span>
                        <span className="flex items-center gap-1">
                          <User size={14} />
                          {isOrganizer(meeting)
                            ? `with ${meeting.attendee.name}`
                            : `from ${meeting.organizer.name}`}
                        </span>
                      </div>

                      {meeting.description && (
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">{meeting.description}</p>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 flex-shrink-0">
                    {/* Attendee can accept/reject pending */}
                    {isAttendee(meeting) && meeting.status === 'pending' && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => handleRespond(meeting._id, 'rejected')}>
                          <X size={14} />
                        </Button>
                        <Button size="sm" onClick={() => handleRespond(meeting._id, 'accepted')}>
                          <Check size={14} />
                        </Button>
                      </>
                    )}

                    {/* Organizer can cancel */}
                    {isOrganizer(meeting) && ['pending', 'accepted'].includes(meeting.status) && (
                      <Button size="sm" variant="outline" onClick={() => handleCancel(meeting._id)}>
                        Cancel
                      </Button>
                    )}

                    {/* Join meeting link */}
                    {meeting.status === 'accepted' && meeting.meetingLink && (
                      <a href={meeting.meetingLink} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" leftIcon={<Video size={14} />}>
                          Join
                        </Button>
                      </a>
                    )}
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {/* Schedule Meeting Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900">Schedule a Meeting</h2>
                <button onClick={() => setShowScheduleModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSchedule} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {user?.role === 'investor' ? 'Select Entrepreneur' : 'Select Investor'}
                  </label>
                  <select
                    value={form.attendeeId}
                    onChange={(e) => setForm({ ...form, attendeeId: e.target.value })}
                    required
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="">Choose a person...</option>
                    {users.map((u) => (
                      <option key={u._id || u.id} value={u._id || u.id}>
                        {u.name} {u.startupName ? `– ${u.startupName}` : u.firmName ? `– ${u.firmName}` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Meeting Title</label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    required
                    placeholder="e.g., Initial pitch discussion"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date & Time</label>
                    <input
                      type="datetime-local"
                      value={form.scheduledAt}
                      onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
                      required
                      min={new Date().toISOString().slice(0, 16)}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Duration (min)</label>
                    <select
                      value={form.duration}
                      onChange={(e) => setForm({ ...form, duration: Number(e.target.value) })}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    >
                      {[15, 30, 45, 60, 90, 120].map((d) => (
                        <option key={d} value={d}>{d} min</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Meeting Type</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: 'video_call', label: 'Video Call', icon: <Video size={16} /> },
                      { value: 'phone_call', label: 'Phone Call', icon: <Phone size={16} /> },
                      { value: 'in_person', label: 'In Person', icon: <MapPin size={16} /> },
                    ].map((type) => (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() => setForm({ ...form, meetingType: type.value })}
                        className={`flex flex-col items-center gap-1 p-2 rounded-md border text-xs transition-colors ${
                          form.meetingType === type.value
                            ? 'border-primary-500 bg-primary-50 text-primary-700'
                            : 'border-gray-200 text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        {type.icon}
                        {type.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    rows={2}
                    placeholder="Brief overview of what you'd like to discuss"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <Button type="button" variant="outline" fullWidth onClick={() => setShowScheduleModal(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" fullWidth isLoading={scheduling}>
                    Schedule Meeting
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
