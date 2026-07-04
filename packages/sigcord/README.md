# Sigcord

Stateful and interactive menus for Discord, utilizing signals for simple state management.

Integrates with [Discord.js](https://discord.js.org) under the hood.

## Installation

Add `sigcord` as a dependency to your `package.json`. JSX is recommended, but not required.

```shell
npm install sigcord @sigcord/jsx
yarn add sigcord @sigcord/jsx
pnpm add sigcord @sigcord/jsx
bun add sigcord @sigcord/jsx

# Without JSX
npm install sigcord
yarn add sigcord
pnpm add sigcord
bun add sigcord
```

### JSX (React syntax)

Sigcord comes with an optional JSX wrapper, types and batteries included. First, install the peer dependency:

```shell
npm install @sigcord/jsx
yarn add @sigcord/jsx
pnpm add @sigcord/jsx
bun add @sigcord/jsx
```

Then configure your JSX to be `react-jsx`, pointing at `@sigcord/jsx` as the import source. For `tsconfig.json`, this
would look something like:

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "@sigcord/jsx"
  }
}
```

### Example Usage

> *Full documentation is planned, but with no set timeline.*

Menus are made of views, but a view can be used standalone. Since the library has evolved to being
functional-component-forward, abandoning the original class-based architecture, let's look at defining and using views
alone.

Views support V1 and V2 components with `defineView` and `defineViewV2` respectively; *you cannot mix-and-match*. Views
take a single type parameter defining the props it accepts, which is useful for dynamically setting up initial state.
Each view takes an `id`, followed by the factory function, and lastly some default options (i.e. `flags` for ephemeral).

```tsx
import {defineView, defineViewV2} from "./defineReactiveView";
import {ActionRowBuilder, ButtonBuilder, EmbedBuilder, MessageFlags} from "discord.js";

interface Props {
  name: string;
}

const HelloWorldV2 = defineViewV2('hello-world-v2', (props) => {
  return (
    <container>
      <h1>Hello World</h1>
      <text>
        Hello, {props.name}, it's great to have you here!
      </text>
      <row>
        <button>{/* ... */}</button>
      </row>
    </container>
  )
}, {flags: MessageFlags.Ephemeral}); // default attributes

const HelloWorld = defineView('hello-world', (props) => {
  return {
    content: 'Some text content',
    embeds: [
      new EmbedBuilder()
        .setTitle('Hello World')
        .setDescription(`Hello, ${props.name}, it's great to have you here!`),
    ],
    components: [
      new ActionRowBuilder().setComponents(
        new ButtonBuilder() //...
      ),
    ],
  };
}, {flags: MessageFlags.Ephemeral}); // default attributes
```

These view functions return a factory that can be invoked directly. It accepts an interaction, followed by an object
that accepts common attributes like `flags` (i.e., `MessageFlags.Ephemeral`) and any props the view accepts:

```ts
import {HelloWorld} from './helloWorld.js';
import type {ChatInputCommandInteraction} from "discord.js";

async function handleInteraction(interaction: ChatInputCommandInteraction): Promise<void> {
  const menuInstance = HelloWorld(interaction, {
    // props
    name: interaction.member.displayName,
    
    // attributes; these override any defaults defined by the view itself.
    flags: MessageFlags.Ephemeral,
  });
  await menuInstance.start();
}
```

Here's a more involved example:

```ts
const menu = SheetEditorV2(lastInteraction, {
  // props
  server: server.document,
  sheet: character,
  viewer: interaction.member,
  author: target,
  wantEdit: true,
  
  // attributes
  renderAfterHandledInteraction: true,
  initialMessage: message,
  flags: MessageFlags.Ephemeral
});
await menu.start();
```

#### Reusable Components

Components are just functions! This approach is pretty similar to React and Solid.

JSX comes preloaded with all available Discord components (including V2 components, e.g. `<container>`). All state
updates are handled by the library itself, no need to define your own `effect()` calls!

```tsx
import {signal} from "sigcord";
import {type ButtonInteraction, ButtonStyle} from "discord.js";
import {computed} from "./computed";

const ButtonMenu = defineViewV2('button-menu', () => {
  return (
    <>
      <h1>Button Clicker!!!</h1>
      <container>
        <row>
          <ClicksButton style={ButtonStyle.Primary} />
          <HotButton hotCount={100} />
        </row>
      </container>
    </>
  );
});

function ClicksButton({style}: { style: ButtonStyle }) {
  const [clicks, setClicks] = signal(0);

  return (
    <button
      id={'click-button'} // optional
      style={style}
      on:click={(b) => setClicks(clicks() + 1)}>
      You have clicked me {clicks} times.
    </button>
  );
}

function HotButton({hotCount}: { hotCount: number }) {
  const [clicks, setClicks] = signal(0);
  const isHot = computed(() => clicks() >= hotCount);
  const onClick = (b: ButtonInteraction) => {
    setClicks(clicks() + 1);
  };

  return (
    <button
      style={() => isHot() ? ButtonStyle.Danger : ButtonStyle.Primary}
      on:click={onClick}
    >
      {() =>
        isHot()
          ? `${clicks()} is a lot of clicks!`
          : `You have clicked me ${clicks()} times.`
      }
    </button>
  )
}
```

If you prefer to gradually adopt this library into existing code, however, the same can be achieved with the underlying
`component()` function! This function takes an optional `id`, a component builder for the actual component to display,
and an event handler. The component builder is returned as-is.

Signal-based libraries typically ban asynchronous event handlers, but all global state is saved to
[`AsyncLocalStorage`](https://nodejs.org/api/async_context.html)! So feel free to `async`/`await` as much as you want :)

`patchEffect(() => {...})` subscribes to signals that are called within it, rerunning each time one of them has changed.
It also notifies the library that each time it reruns, something might have changed, kicking off an edit to the message
with the newly-modified content. Since signals are granular, only the relevant code dependent on a signal reruns rather
than reexecuting the entire component!

There is a non-patch version `effect()` that may be useful for logging.

```ts
import {ButtonBuilder, ButtonStyle} from "discord.js";
import {patchEffect} from "./builtins";
import {computed} from "./computed";

function HotButton({hotCount}: { hotCount: number }) {
  const [clicks, setClicks] = signal(0);
  const isHot = computed(() => clicks() >= hotCount);

  const button = new ButtonBuilder();
  patchEffect(() => {
    button
      .setStyle(isHot() ? ButtonStyle.Danger : ButtonStyle.Primary)
      .setLabel(
        isHot()
          ? `${clicks()} is a lot of clicks!`
          : `You have clicked me ${clicks()} times.`
      )
  });

  return component({
    component: button,
    handler: (b) => setClicks(clicks() + 1),
  });
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
