import type {
  ReactiveViewPayload,
  ReactiveViewPayloadV1,
  ReactiveViewPayloadV2,
} from '../viewFlavors.js';
import type { PropsBase } from '../viewDefinitionBase.js';

export type ReactiveViewFactory<Props extends PropsBase> =
  | ReactiveViewFactoryV1<Props>
  | ReactiveViewFactoryV2<Props>;
type ReactiveViewFactoryFn<
  Props extends PropsBase,
  Payload extends ReactiveViewPayload,
> = (props: Props) => Payload;

export type ReactiveViewFactoryV1<Props extends PropsBase> =
  ReactiveViewFactoryFn<Props, ReactiveViewPayloadV1>;

export type ReactiveViewFactoryV2<Props extends PropsBase> =
  ReactiveViewFactoryFn<Props, ReactiveViewPayloadV2>;
