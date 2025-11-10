declare namespace JSX {
  interface IntrinsicElements {
    'altcha-widget': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
      challengeurl?: string;
      auto?: string;
      hidefooter?: boolean;
    };
  }
}
