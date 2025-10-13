import { setIcon, setTooltip } from 'obsidian';
import { Accessor, createEffect, onMount, Setter } from 'solid-js';

export { IconButton, IconToggle, IMAGE_ICON_URL, InlineIcon };

function IconButton(props: {
	name: 'chevron-left' | 'chevron-right' | 'dollar-sign' | 'info' | 'link' | 'notebook-text' | 'undo-2' | 'x'
	enabled: Accessor<boolean>
	onClick: (evt: MouseEvent) => void
	tooltip?: string
	class?: string
	classList?: { [key: string]: boolean }
}) {
	let iconRef!: HTMLDivElement;

	onMount(() => {
		setIcon(iconRef, props.name);
		if (props.tooltip) setTooltip(iconRef, props.tooltip, { placement: 'top', delay: 200 });
	});

	const defaultClass = 'iconButton flex-center'

	return (
		<div ref={iconRef}
			class={props.class ? `${props.class} ${defaultClass}` : defaultClass}
			classList={{ 'enabled': props.enabled(), ...props.classList }}
			onClick={(evt) => {
				if (props.enabled()) {
					props.onClick(evt);
				}
			}}
		/>
	);
}

function IconToggle(props: {
	onIcon: 'eye',
	offIcon: 'eye-off',
	onTooltip: string,
	offTooltip: string,
	state: Accessor<boolean>,
	setState: Setter<boolean>,
	class?: string,
}) {
	let iconRef!: HTMLDivElement;

	createEffect(() => {
		if (props.state()) {
			setIcon(iconRef, props.onIcon);
			setTooltip(iconRef, props.onTooltip, { placement: 'top', delay: 200 });
		} else {
			setIcon(iconRef, props.offIcon);
			setTooltip(iconRef, props.offTooltip, { placement: 'top', delay: 200 });
		}
	});

	const defaultClass = 'iconToggle flex-center'

	return (
		<div ref={iconRef}
			class={props.class ? `${props.class} ${defaultClass}` : defaultClass}
			classList={{ 'enabled': props.state() }}
			onClick={() => {
				props.setState(prev => !prev);
			}}
		/>
	);
}

function InlineIcon(props: {
	name: 'circle-check-big' | 'circle-minus' | 'info'
	class?: string,
}) {
	let iconRef!: HTMLSpanElement;

	createEffect(() => {
		setIcon(iconRef, props.name);
	});

	const defaultClass = 'inlineIcon'

	return (
		<span ref={iconRef}
			class={props.class ? `${props.class} ${defaultClass}` : defaultClass}
		/>
	);
}

const IMAGE_ICON_URL = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIGNsYXNzPSJsdWNpZGUgbHVjaWRlLWltYWdlLWljb24gbHVjaWRlLWltYWdlIj48cmVjdCB3aWR0aD0iMTgiIGhlaWdodD0iMTgiIHg9IjMiIHk9IjMiIHJ4PSIyIiByeT0iMiIvPjxjaXJjbGUgY3g9IjkiIGN5PSI5IiByPSIyIi8+PHBhdGggZD0ibTIxIDE1LTMuMDg2LTMuMDg2YTIgMiAwIDAgMC0yLjgyOCAwTDYgMjEiLz48L3N2Zz4='