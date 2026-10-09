import { useEffect, useRef, useState } from 'react';
import { displayNumber } from './bodyGoalValues';
// Keep the entered decimal text while storing canonical units. Unit switches do not round stored measurements.
export default function MeasurementInput({ value, scale, onChange, min, max, ...props }) {
  const format = v => v === '' || v == null ? '' : String(displayNumber(v / scale));
  const [text, setText] = useState(() => format(value));
  const previousScale = useRef(scale);
  useEffect(() => {
    const canonical = text === '' ? '' : Number(text) * scale;
    if (previousScale.current !== scale || (value === '' ? text !== '' : Math.abs(canonical - value) > 0.000001)) setText(format(value));
    previousScale.current = scale;
  }, [value, scale]);
  return <input {...props} type="number" step="any" min={Math.floor(min / scale * 100) / 100} max={Math.ceil(max / scale * 100) / 100} value={text}
    onChange={e => { setText(e.target.value); onChange(e.target.value === '' ? '' : Number(e.target.value) * scale); }}/>;
}
