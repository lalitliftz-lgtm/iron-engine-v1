import { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';

const SubscriptionContext = createContext({});

export const SubscriptionProvider = ({ children }) => {
  const { user } = useAuth();
  const [status, setStatus] = useState('loading');
  const [programCount, setProgramCount] = useState(0);

  useEffect(() => {
    if (!user) {
      setStatus('free');
      setProgramCount(0);
      return;
    }

    const fetchStatus = async () => {
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('end_date')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .gte('end_date', new Date().toISOString())
        .maybeSingle();

      const { count } = await supabase
        .from('generated_programs')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id);

      setProgramCount(count || 0);

      if (sub) {
        setStatus('pro_active');
      } else {
        const { data: expiredSub } = await supabase
          .from('subscriptions')
          .select('end_date')
          .eq('user_id', user.id)
          .order('end_date', { ascending: false })
          .limit(1)
          .maybeSingle();

        setStatus(expiredSub ? 'pro_expired' : 'free');
      }
    };

    fetchStatus();
  }, [user]);

  return (
    <SubscriptionContext.Provider value={{ status, programCount }}>
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = () => useContext(SubscriptionContext);
