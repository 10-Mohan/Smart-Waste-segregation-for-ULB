import { useEffect, useRef, useState } from 'react';
import Spinner from '../../components/ui/Spinner.jsx';
import useDocumentTitle from '../../hooks/useDocumentTitle.js';
import {
  CITIZEN_CODE_KEY,
  CITIZEN_PHONE_LAST4_KEY,
  clearCitizenSession,
  getCitizenStatus,
  getCitizenToken,
  saveCitizenSession,
  saveCitizenToken,
} from '../../services/citizenService.js';
import CitizenDashboard from './CitizenDashboard.jsx';
import CitizenLanding from './CitizenLanding.jsx';
import './citizen.css';

function verificationError(error) {
  if (error.response?.status === 429) return 'Too many tries. Please wait a few minutes and try again.';
  if (!error.response) return "Can't reach the server right now.";
  return "We couldn't match those details. Check the code on your bin and your phone digits.";
}

export default function Citizen() {
  const [verified, setVerified] = useState(null);
  const [initializing, setInitializing] = useState(true);
  const [verificationErrorText, setVerificationErrorText] = useState('');
  const [landingTab, setLandingTab] = useState(undefined);
  const dashboardHeading = useRef(null);
  const queryCode = new URLSearchParams(window.location.search).get('code') || '';
  const [landingCode, setLandingCode] = useState(() => queryCode || sessionStorage.getItem(CITIZEN_CODE_KEY) || '');
  useDocumentTitle(verified ? 'My household' : 'Citizen');

  useEffect(() => {
    let active = true;
    const code = sessionStorage.getItem(CITIZEN_CODE_KEY);
    const phoneLast4 = sessionStorage.getItem(CITIZEN_PHONE_LAST4_KEY) || '';
    const hasToken = Boolean(getCitizenToken());
    if (!code || (!phoneLast4 && !hasToken)) {
      setInitializing(false);
      return () => { active = false; };
    }
    getCitizenStatus(code, phoneLast4)
      .then((status) => { if (active) setVerified({ code, phoneLast4, status }); })
      .catch((error) => {
        if (!active) return;
        const isStale = error.response?.status === 404 || error.response?.status === 401 || error.response?.status === 403;
        setLandingCode(code);
        setLandingTab(hasToken ? 'signin' : 'code');
        if (isStale) {
          clearCitizenSession();
          setVerified(null);
          setVerificationErrorText(hasToken
            ? 'Your session has expired. Please sign in again.'
            : "We couldn't find that household. Please check your details or register again.");
        } else {
          setVerificationErrorText(verificationError(error));
        }
      })
      .finally(() => { if (active) setInitializing(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (verified) dashboardHeading.current?.focus();
  }, [verified]);

  async function verify(code, phoneLast4) {
    const normalizedCode = code.trim().toUpperCase();
    try {
      const status = await getCitizenStatus(normalizedCode, phoneLast4);
      saveCitizenSession(normalizedCode, phoneLast4);
      setVerificationErrorText('');
      setVerified({ code: normalizedCode, phoneLast4, status });
      return true;
    } catch (error) {
      const message = verificationError(error);
      setVerificationErrorText(message);
      return message;
    }
  }

  async function startSession({ token, household }) {
    saveCitizenToken(token, household.qrCode);
    try {
      const status = await getCitizenStatus(household.qrCode, '');
      setVerificationErrorText('');
      setVerified({ code: household.qrCode, phoneLast4: '', status });
      return true;
    } catch (error) {
      clearCitizenSession();
      return error.response ? 'Signed in, but we could not load your household. Please try again.' : "Can't reach the server right now.";
    }
  }

  function handleSessionStale(customMessage) {
    const hadToken = Boolean(getCitizenToken());
    const currentCode = verified?.code || sessionStorage.getItem(CITIZEN_CODE_KEY) || landingCode;
    clearCitizenSession();
    setVerified(null);
    if (currentCode) setLandingCode(currentCode);
    setLandingTab(hadToken ? 'signin' : 'code');
    setVerificationErrorText(customMessage || (hadToken
      ? 'Your session has expired. Please sign in again.'
      : "We couldn't find that household. Please check your details or register again."));
  }

  function switchHousehold() {
    clearCitizenSession();
    setVerified(null);
    setVerificationErrorText('');
    setLandingTab('signin');
  }

  if (initializing) {
    return <div className="citizen-page citizen-loading"><Spinner label="Checking your household" /></div>;
  }

  return (
    <div className="citizen-page">
      {verified
        ? <CitizenDashboard
          ref={dashboardHeading}
          code={verified.code}
          phoneLast4={verified.phoneLast4}
          initialStatus={verified.status}
          onSwitchHousehold={switchHousehold}
          onSessionStale={handleSessionStale}
          onStatusUpdate={(status) => setVerified((current) => current ? { ...current, status } : current)}
        />
        : <CitizenLanding
          initialCode={landingCode}
          initialTab={landingTab}
          initialError={verificationErrorText}
          onVerify={verify}
          onSession={startSession}
        />}
    </div>
  );
}