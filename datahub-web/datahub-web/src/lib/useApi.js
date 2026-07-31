import { useCallback, useEffect, useRef, useState } from 'react';

/** Pemanggil data dengan keadaan eksplisit: loading | ready | error.
 *  Keadaan kosong ditentukan oleh pemanggil dari isi data.
 *  Semuanya wajib ditangani di UI (Userflow bagian 6). */
export function useApi(fn, params) {
  const [state, setState] = useState({ status: 'loading', data: null, error: null });
  const alive = useRef(true);
  const key = JSON.stringify(params ?? {});

  const run = useCallback(() => {
    setState((s) => ({ ...s, status: 'loading' }));
    fn(JSON.parse(key))
      .then((data) => { if (alive.current) setState({ status: 'ready', data, error: null }); })
      .catch((error) => { if (alive.current) setState({ status: 'error', data: null, error }); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    alive.current = true;
    run();
    return () => { alive.current = false; };
  }, [run]);

  return { ...state, reload: run };
}
