import { useEffect } from 'react';

export default function useDocumentTitle(title) {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = `${title} | Waste Segregation Monitoring`;
    return () => { document.title = previousTitle; };
  }, [title]);
}