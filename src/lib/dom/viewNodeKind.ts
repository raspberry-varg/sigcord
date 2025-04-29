import type { EmbedBuilder } from 'discord.js';
import type { Children, ViewComponent } from '../MenuView.js';

export type ViewNodeKind = Children<EmbedBuilder | ViewComponent>;
