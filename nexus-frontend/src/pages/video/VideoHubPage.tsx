import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { usersAPI } from '../../services/api';
import { Button } from '../../components/ui/Button';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';

export const VideoHubPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [targets, setTargets] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadTargets = async () => {
      if (!user) return;

      try {
        setIsLoading(true);
        const { data } =
          user.role === 'investor'
            ? await usersAPI.getEntrepreneurs()
            : await usersAPI.getInvestors();

        const list = user.role === 'investor' ? data.data.entrepreneurs : data.data.investors;
        setTargets(list || []);
      } catch (err) {
        setError('Unable to load call targets.');
      } finally {
        setIsLoading(false);
      }
    };

    loadTargets();
  }, [user]);

  if (!user) return null;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Video Calls</h1>
        <p className="text-gray-600">Select a person to start a video call.</p>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-medium text-gray-900">Available Call Targets</h2>
        </CardHeader>
        <CardBody>
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary-600 mx-auto" />
            </div>
          ) : error ? (
            <div className="text-center py-12 text-red-600">{error}</div>
          ) : targets.length === 0 ? (
            <div className="text-center py-12 text-gray-600">
              No users available for video calls right now.
            </div>
          ) : (
            <div className="space-y-4">
              {targets.map((target) => (
                <div key={target.id || target._id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 border rounded-lg">
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-primary-700 text-sm font-semibold">
                        {target.name?.charAt(0) || 'U'}
                      </span>
                      <div>
                        <h3 className="text-base font-semibold text-gray-900">{target.name}</h3>
                        <p className="text-sm text-gray-500">{target.role === 'investor' ? 'Investor' : 'Entrepreneur'}</p>
                      </div>
                    </div>
                    {target.bio && <p className="mt-2 text-sm text-gray-600">{target.bio}</p>}
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge variant="primary">{target.role}</Badge>
                    <Button onClick={() => navigate(`/video/${target.id || target._id}`)}>
                      Call
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
};
