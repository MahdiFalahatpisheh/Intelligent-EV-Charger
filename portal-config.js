/* Public configuration for the portal pages. Both values are public by design (browser-safe); Row Level Security in the database protects the data.
   Never put a service-role or secret key in this file or anywhere in this repository. */
window.PORTAL_CONFIG = {
  url: 'https://kwbniolxdstexdkpqffi.supabase.co',
  key: 'sb_publishable_tcsQGJ7SJbHapuq2gAS7mA_59UKk6KG',
  /* Page switches, not security: the database decides who may do what. */
  allowSignUp: true,   /* Q-W04: keep on until the admin account exists, then turn off (invite-only) */
  magicLink: false     /* Q-W06: off until login methods are decided */
};
