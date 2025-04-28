// src/types/global.d.ts (or any other .d.ts file included in your tsconfig)

declare namespace JSX {
    interface IntrinsicElements {
      'gen-search-widget': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        // Define the specific props your custom element accepts
        configId: string;
        triggerId: string;
        // Add any other known attributes the widget might accept here
        // e.g., context?: string; location?: string; etc.
      };
    }
  }