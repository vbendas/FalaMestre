import '@aframe/core';

declare module '@aframe/core' {
  interface Entity {
    setAttribute: (attr: string, value: unknown) => void;
  }
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'a-scene': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
        vrModeUi?: string;
        renderer?: string;
        embedded?: boolean;
      }, HTMLElement>;
      'a-assets': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      'a-asset-item': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
        id?: string;
        src?: string;
      }, HTMLElement>;
      'a-sky': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
        color?: string;
        src?: string;
      }, HTMLElement>;
      'a-plane': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
        position?: string;
        width?: number;
        height?: number;
        rotation?: string;
        color?: string;
        material?: string;
      }, HTMLElement>;
      'a-box': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
        position?: string;
        width?: number;
        height?: number;
        depth?: number;
        color?: string;
        material?: string;
      }, HTMLElement>;
      'a-sphere': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
        position?: string;
        radius?: number;
        color?: string;
        material?: string;
        animation?: string | {
          property?: string;
          to?: string;
          dur?: number;
          easing?: string;
          loop?: boolean | string;
          dir?: string;
        };
      }, HTMLElement>;
      'a-cylinder': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
        position?: string;
        radius?: number;
        height?: number;
        color?: string;
        material?: string;
        rotation?: string;
      }, HTMLElement>;
      'a-circle': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
        position?: string;
        radius?: number;
        color?: string;
        material?: string;
        rotation?: string;
      }, HTMLElement>;
      'a-entity': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
        id?: string;
        position?: string;
        rotation?: string;
        scale?: string;
        light?: string;
        animation?: string;
      }, HTMLElement>;
      'a-camera': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
        id?: string;
        position?: string;
        lookControls?: string;
        wasdControls?: string;
      }, HTMLElement>;
      'a-text': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
        value?: string;
        position?: string;
        align?: string;
        width?: number;
        color?: string;
        font?: string;
        side?: string;
      }, HTMLElement>;
      'a-cursor': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      'a-img': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
        src?: string;
        position?: string;
        width?: number;
        height?: number;
      }, HTMLElement>;
      'a-video': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
        src?: string;
        position?: string;
        width?: number;
        height?: number;
      }, HTMLElement>;
      'a-light': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
        type?: string;
        color?: string;
        intensity?: number;
        position?: string;
      }, HTMLElement>;
      'a-sound': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
        src?: string;
        autoplay?: boolean;
        loop?: boolean;
        volume?: number;
      }, HTMLElement>;
      'a-animation': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
        attribute?: string;
        dur?: number;
        easing?: string;
        fill?: string;
        from?: string;
        repeat?: number | string;
        to?: string;
      }, HTMLElement>;
    }
  }
}

export {};
