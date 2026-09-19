import type {EffectFn} from '../../../lib/reactivity/core/signals.js';
import type {DisposeFn} from '../../../lib/render/dispose.js';
import {effect} from '../effect.js';
import {usePatchTarget} from '../usePatchTarget.js';

/**
 * @deprecated Use {@link effect} in conjunction with {@link dirty}.
 *
 * Create an effect that runs when signals referenced in the effect function
 * change. This effect will automatically request an update to the user's UI
 * based on the current rendering context.
 *
 * Useful for mutating state of content objects like component or embed builders
 * and having the change reflected to the user.
 *
 * Note: This is not required if you use a {@link computed} embed or component.
 *
 * @example
 * ```ts
 * function CountingButton() {
 *   const [clicks, setClicks] = signal(0);
 *    const button = new ButtonBuilder().setStyle(ButtonStyle.Primary);
 *    patchEffect(() => {
 *      // effect runs each time setClicks mutates the value
 *      button.setLabel(`You have clicked me ${clicks()} times.`);
 *    });
 *    // register component handler; the `button` variable is returned directly
 *    return component({
 *      component: button,
 *      handler: () => setClicks((prev) => prev + 1),
 *    });
 * }
 *
 * // components V2: anywhere within the top-level view call
 * const viewV2 = defineViewV2('my-view', () => {
 *   return [
 *     new ActionRowBuilder<ButtonBuilder>().setComponents(
 *       CountingButton(),
 *     ),
 *   ];
 * });
 *
 * // components V1: within the function passed to ReactiveViewPayloadV1#components.
 * const viewV1 = defineView('my-view', () => {
 *   return {
 *     components: () => [
 *       new ActionRowBuilder<ButtonBuilder>().setComponents(
 *         CountingButton(),
 *       ),
 *     ];
 *   };
 * });
 * ```
 *
 * @param effectFn Effect function that mutates content in the current
 *   {@link PatchTarget} context.
 */
export function patchEffect(effectFn: EffectFn): DisposeFn {
  const patchTarget = usePatchTarget();
  return effect(effectFn, patchTarget);
}
