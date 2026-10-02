import { Link } from 'react-router-dom';
import './Button.css';

export default function Button({
  to,
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...props
}) {
  const classes = `ui-button ui-button--${variant} ui-button--${size} ${className}`.trim();
  return to
    ? <Link className={classes} to={to} {...props}>{children}</Link>
    : <button className={classes} {...props}>{children}</button>;
}