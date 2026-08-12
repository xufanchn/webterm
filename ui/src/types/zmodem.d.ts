declare module 'zmodem.js/src/zmodem_browser.js' {
  const Zmodem: {
    Sentry: any;
    Browser: { send_files: any; save_to_disk: any };
    Error: any;
  };
  export default Zmodem;
}
