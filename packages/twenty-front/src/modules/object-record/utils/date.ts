export const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return 'Unknown';

  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short'
    });
  } catch {
    return 'Invalid date';
  }
};

export const getSourceLabel = (source: string | null | undefined): string => {
  if (!source) return 'Manual';

  const sourceMap: Record<string, string> = {
    linkedin: 'LinkedIn',
    microsoft: 'Microsoft',
    email: 'Email',
    outlook: 'Outlook',
    whatsapp: 'WhatsApp',
  };

  return sourceMap[source.toLowerCase()] || source;
};
