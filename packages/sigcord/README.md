# Sigcord

Stateful and interactive menus for Discord, utilizing signals for simple state management.

Integrates with [Discord.js](https://discord.js.org) under the hood.

## Installation

Add `sigcord` as a dependency to your `package.json`. JSX is supported out of the box.

**Note that [Discord.js](https://discord.js.org) is required.**

```shell
npm install sigcord discord.js
yarn add sigcord discord.js
pnpm add sigcord discord.js
bun add sigcord discord.js
```

### JSX (React syntax)

Sigcord supports writing UI in JSX, types and batteries included. First, install the peer dependency:

Configure your JSX to be `react-jsx`, pointing at `sigcord` as the import source. For `tsconfig.json`, this
would look something like:

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "sigcord"
  }
}
```

Once that's done, you can start using JSX in your views:

```tsx
import { ButtonStyle } from 'discord.js';

function ClickMe({ name }: { name: string }) {
  return (
    <button
      style={ButtonStyle.PRIMARY}
      onClick={(button) => {
        /* ... */
      }}
    >
      Click me, {name}!
    </button>
  );
}

function App() {
  return <ClickMe name="Sigcord" />;
}
```

### Hyperscript (For the JSX-averse)

You can use a simple `h` function that is provided by `sigcord`, which powers the underlying JSX wrapper:

```tsx
import { h } from 'sigcord';

function ClickMe({ name }: { name: string }) {
  return h('button', {
    style: ButtonStyle.PRIMARY,
    onClick: (button) => {
      /* ... */
    },
    children: ['Click me, ', name, '!'],
  });
}

function App() {
  return h(ClickMe, {});
}
```

### Example Usage

> _Full documentation is planned, but with no set timeline._

Menus are made of views, but a view can be used standalone. Since the library has evolved to being
functional-component-forward, abandoning the original class-based architecture, let's look at defining and using views
alone.

Views support V1 and V2 components with `defineView` and `defineViewV2` respectively; _you cannot mix-and-match_. Views
take a single type parameter defining the props it accepts, which is useful for dynamically setting up initial state.
Each view takes an `id`, followed by the factory function, and lastly some default options (i.e. `flags` for ephemeral).

```tsx
import { ButtonBuilder, ButtonStyle } from 'discord.js';

interface Props {
  name: string;
}

function HelloWorldV2(props: Props) {
  const builder = new ButtonBuilder();
  return (
    <container>
      <h1>Hello World</h1>
      <text>Hello, {props.name}, it's great to have you here!</text>
      <actionRow>
        <button
          style={ButtonStyle.PRIMARY}
          onClick={(button) => {
            /* ... */
          }}
        >
          {/* ... */}
        </button>
        {builder /* supports builders and API data for incremental adoption/simplicity */}
      </actionRow>
    </container>
  );
}

function HelloWorld(props: Props) {
  return {
    content: 'Some text content',
    embeds: [
      new EmbedBuilder()
        .setTitle('Hello World')
        .setDescription(`Hello, ${props.name}, it's great to have you here!`),
    ],
    components: [
      <actionRow>
        <button
          style={ButtonStyle.PRIMARY}
          onClick={(button) => {
            /* ... */
          }}
        >
          {/* ... */}
        </button>
        {builder /* supports builders and API data for incremental adoption/simplicity */}
      </actionRow>,
    ],
  };
}
```

These view functions return a factory that can be invoked directly. It accepts an interaction, followed by an object
that accepts common attributes like `flags` (i.e., `MessageFlags.Ephemeral`) and any props the view accepts:

```tsx
import type { ChatInputCommandInteraction } from 'discord.js';
import { composeCord } from './cordComposer';

async function handleInteraction(interaction: ChatInputCommandInteraction): Promise<void> {
  const result = await composeCord()
    .ephemeral()
    .mountV1(interaction, () => <HelloWorld />);
}

async function handleInteraction(interaction: ChatInputCommandInteraction): Promise<void> {
  const result = await composeCord()
    .ephemeral()
    .mount(interaction, () => <HelloWorldV2 />);
}
```

Here's a more involved example:

```tsx
import { composeCord } from './cordComposer';
import { SheetEditorV2 } from './view';
import { ViewerContext } from './viewerContext';

const ViewerContext = createContext<{ viewer: Member }>();

const AuthCord = composeCord()
  .requires(ViewerContext) // enforce at the type-level that this context is provided
  .use(async (interaction, next) => {
    // ...authentication, skip next() if not authorized.
    await next();
  });

const result = await composeCord()
  .extends(AuthCord)
  .ephemeral()
  .provide(ViewerContext, { viewer: interaction.member })
  .use(async (interaction, next) => {
    // ...some middleware
    await next();
  })
  .mount(() => (
    <SheetEditorV2 server={server.document} sheet={character} author={target} wantEdit />
  ));
```

#### Reusable Components

Components are just functions! This approach is pretty similar to React and Solid.

JSX comes preloaded with all available Discord components (including V2 components, e.g. `<container>`). All state
updates are handled by the library itself, no need to define your own `effect()` calls!

```tsx
import { signal } from 'sigcord';
import { type ButtonInteraction, ButtonStyle } from 'discord.js';
import { computed } from './computed';

function ButtonMenu() {
  return (
    <>
      <h1>Button Clicker!!!</h1>
      <container>
        <actionRow>
          <ClicksButton style={ButtonStyle.Primary} />
          <HotButton hotCount={100} />
        </actionRow>
      </container>
    </>
  );
}

function ClicksButton({ style }: { style: ButtonStyle }) {
  const [clicks, setClicks] = signal(0);

  return (
    <button
      id={'click-button'} // optional
      style={style}
      onClick={(b) => setClicks(clicks() + 1)}
    >
      You have clicked me {clicks} times.
    </button>
  );
}

function HotButton({ hotCount }: { hotCount: number }) {
  const [clicks, setClicks] = signal(0);
  const isHot = computed(() => clicks() >= hotCount);
  const onClick = (b: ButtonInteraction) => {
    setClicks(clicks() + 1);
  };

  return (
    <button style={() => (isHot() ? ButtonStyle.Danger : ButtonStyle.Primary)} onClick={onClick}>
      {() =>
        isHot() ? `${clicks()} is a lot of clicks!` : `You have clicked me ${clicks()} times.`
      }
    </button>
  );
}
```

If you prefer to gradually adopt this library into existing code, however, there are some hooks that can help you out!

Signal-based libraries typically ban asynchronous event handlers, but global state is saved to
[`AsyncLocalStorage`](https://nodejs.org/api/async_context.html)! So feel free to `async`/`await` as much as you want :)

`effect(() => {...})` subscribes to signals that are called within it, rerunning each time one of them has changed.

If you are manually updating some display components, be sure to call `markDirty()` so that the library knows to redraw
the UI and update the message with the new reply.

Since signals are granular, only the relevant code dependent on a signal will rerun rather than reexecuting the entire component!

```ts
import { ButtonBuilder, ButtonStyle } from 'discord.js';
import { computed, effect, markDirty, createUniqueComponentId } from 'sigcord';
import { useComponentHandler } from './useComponentHandler';

function HotButton({ hotCount }: { hotCount: number }) {
  const [clicks, setClicks] = signal(0);
  const isHot = computed(() => clicks() >= hotCount);

  const id = createUniqueComponentId();
  const button = new ButtonBuilder().setCustomId(id);
  useComponentHandler(id, (button) => {
    setClicks(clicks() + 1);
  });
  effect(() => {
    button
      .setStyle(isHot() ? ButtonStyle.Danger : ButtonStyle.Primary)
      .setLabel(
        isHot() ? `${clicks()} is a lot of clicks!` : `You have clicked me ${clicks()} times.`,
      );
    markDirty();
  });

  return button;
}
```

## Help

Support Discord server coming soon. While open-sourced and provided as an npm package, this library is mainly servicing
bots that I have built. Testing is virtually non-existent.

That being said, please feel free to open issues, I'll be sure to take a look and see what I can do :)

Full documentation is planned, but with no set timeline.

## Author

[@raspberry-varg](https://github.com/raspberry-varg)

## License

This project is licensed under the **Apache 2.0 License** - see the [LICENSE](LICENSE) file for details.
