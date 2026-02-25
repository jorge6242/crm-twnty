export const getProfileUrl = ( provider: string ,profileSlug: string) => {
  switch (provider) {
    case 'linkedin':
      return `https://www.linkedin.com/in/${profileSlug}/`;
    case 'microsoft':
      return `https://outlook.office365.com/people/${profileSlug}`;
    default:
      return profileSlug;
  }
};
