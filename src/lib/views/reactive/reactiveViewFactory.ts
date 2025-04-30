import type { ClassViewProps } from '../../FunctionalMenuView.js';
import type {
  ReactiveViewPayload,
  ReactiveViewPayloadV1,
  ReactiveViewPayloadV2,
} from '../../MenuView.js';
import type { PropsBase } from '../../MenuView/ViewBase.js';

export type ReactiveViewFactory<Props extends PropsBase> =
  | ReactiveViewFactoryV1<Props>
  | ReactiveViewFactoryV2<Props>;
type ReactiveViewFactoryFn<
  Props extends PropsBase,
  Payload extends ReactiveViewPayload,
> = (props: ClassViewProps<Props>) => Payload;

export type ReactiveViewFactoryV1<Props extends PropsBase> =
  ReactiveViewFactoryFn<Props, ReactiveViewPayloadV1>;

export type ReactiveViewFactoryV2<Props extends PropsBase> =
  ReactiveViewFactoryFn<Props, ReactiveViewPayloadV2>;
