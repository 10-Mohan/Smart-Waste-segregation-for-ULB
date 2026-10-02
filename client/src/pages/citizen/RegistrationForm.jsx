import { useEffect, useState } from 'react';
import Button from '../../components/ui/Button.jsx';
import Card from '../../components/ui/Card.jsx';
import Spinner from '../../components/ui/Spinner.jsx';
import { getCitizenWards, registerCitizenHousehold } from '../../services/citizenService.js';

function validate(values) {
  const errors = {};
  if (values.ownerName.trim().length < 2 || values.ownerName.trim().length > 80) errors.ownerName = 'Enter a name between 2 and 80 characters.';
  if (!/^[6-9]\d{9}$/.test(values.phone)) errors.phone = 'Enter a valid 10-digit Indian mobile number.';
  if (values.address.trim().length < 5 || values.address.trim().length > 200) errors.address = 'Enter an address between 5 and 200 characters.';
  if (!values.wardId) errors.wardId = 'Choose your ward.';
  if (!values.consent) errors.consent = 'Please agree before continuing.';
  return errors;
}

export default function RegistrationForm({ onSuccess }) {
  const [wards, setWards] = useState([]);
  const [wardsLoading, setWardsLoading] = useState(true);
  const [values, setValues] = useState({ ownerName: '', phone: '', address: '', type: 'residential', wardId: '', consent: false });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    getCitizenWards()
      .then((items) => { if (active) setWards(items); })
      .catch(() => { if (active) setServerError("Can't load wards right now. Please try again."); })
      .finally(() => { if (active) setWardsLoading(false); });
    return () => { active = false; };
  }, []);

  function setField(field, value) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: '' }));
    setServerError('');
  }

  async function submit(event) {
    event.preventDefault();
    const validationErrors = validate(values);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length) return;
    setSubmitting(true);
    setServerError('');
    try {
      const result = await registerCitizenHousehold({
        ownerName: values.ownerName.trim(),
        phone: values.phone,
        address: values.address.trim(),
        type: values.type,
        wardId: Number(values.wardId),
        consent: true,
      });
      onSuccess(result, values.phone.slice(-4));
    } catch (error) {
      const status = error.response?.status;
      if (status === 409) setServerError(error.response.data.error?.message || 'This household may already be registered. Use your existing code, or ask your collection worker.');
      else if (status === 429) setServerError('Too many registrations from this connection. Please try again later.');
      else if (status === 422) setServerError(error.response.data.error?.details?.[0]?.message || 'Check the details and try again.');
      else setServerError("Can't reach the server right now. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="citizen-form-card">
      <form className="citizen-form" onSubmit={submit} noValidate>
        <div className="citizen-field">
          <label htmlFor="citizen-owner-name">Your name</label>
          <input id="citizen-owner-name" autoComplete="name" maxLength={80} required value={values.ownerName} aria-invalid={Boolean(errors.ownerName)} aria-describedby={errors.ownerName ? 'citizen-owner-error' : undefined} onChange={(event) => setField('ownerName', event.target.value)} />
          {errors.ownerName && <span className="citizen-field-error" id="citizen-owner-error">{errors.ownerName}</span>}
        </div>
        <div className="citizen-field">
          <label htmlFor="citizen-phone">Mobile number</label>
          <input id="citizen-phone" inputMode="numeric" autoComplete="tel-national" pattern="[6-9][0-9]{9}" maxLength={10} required value={values.phone} aria-invalid={Boolean(errors.phone)} aria-describedby={errors.phone ? 'citizen-phone-error' : 'citizen-phone-help'} onChange={(event) => setField('phone', event.target.value.replace(/\D/g, '').slice(0, 10))} />
          <span id="citizen-phone-help" className="citizen-field-help">10 digits, starting with 6-9</span>
          {errors.phone && <span className="citizen-field-error" id="citizen-phone-error">{errors.phone}</span>}
        </div>
        <div className="citizen-field">
          <label htmlFor="citizen-address">Address</label>
          <textarea id="citizen-address" autoComplete="street-address" minLength={5} maxLength={200} required value={values.address} aria-invalid={Boolean(errors.address)} aria-describedby={errors.address ? 'citizen-address-error' : undefined} onChange={(event) => setField('address', event.target.value)} />
          {errors.address && <span className="citizen-field-error" id="citizen-address-error">{errors.address}</span>}
        </div>
        <fieldset className="citizen-type-options">
          <legend>Type</legend>
          <label><input type="radio" name="citizen-type" checked={values.type === 'residential'} onChange={() => setField('type', 'residential')} /> Home</label>
          <label><input type="radio" name="citizen-type" checked={values.type === 'commercial'} onChange={() => setField('type', 'commercial')} /> Shop or business</label>
        </fieldset>
        <div className="citizen-field">
          <label htmlFor="citizen-ward">Ward</label>
          <select id="citizen-ward" required value={values.wardId} aria-invalid={Boolean(errors.wardId)} aria-describedby={errors.wardId ? 'citizen-ward-error' : undefined} disabled={wardsLoading || !wards.length} onChange={(event) => setField('wardId', event.target.value)}>
            <option value="">{wardsLoading ? 'Loading wards…' : 'Choose your ward'}</option>
            {wards.map((ward) => <option key={ward.id} value={ward.id}>{ward.name}</option>)}
          </select>
          {errors.wardId && <span className="citizen-field-error" id="citizen-ward-error">{errors.wardId}</span>}
        </div>
        <div className="citizen-consent">
          <label htmlFor="citizen-consent">
            <input id="citizen-consent" type="checkbox" checked={values.consent} aria-invalid={Boolean(errors.consent)} aria-describedby={errors.consent ? 'citizen-consent-error' : undefined} onChange={(event) => setField('consent', event.target.checked)} />
            <span>I agree that my household details are used to track waste collection.</span>
          </label>
          {errors.consent && <span className="citizen-field-error" id="citizen-consent-error">{errors.consent}</span>}
        </div>
        {serverError && <p className="citizen-error" role="alert">{serverError}</p>}
        <Button type="submit" className="citizen-touch-button" disabled={submitting || wardsLoading || !wards.length}>
          {submitting ? <Spinner size="sm" label="Registering" /> : 'Register household'}
        </Button>
      </form>
    </Card>
  );
}