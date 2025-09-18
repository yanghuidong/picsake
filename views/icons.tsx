import { setIcon } from 'obsidian';
import { Accessor, createEffect, onMount, Setter } from 'solid-js';

export { IconButton, IconToggle, InlineIcon };

function IconButton(props: {
	name: 'undo-2' | 'x'
	enabled: Accessor<boolean>
	onClick: (evt: MouseEvent) => void
	class?: string
	classList?: { [key: string]: boolean }
}) {
	let iconRef!: HTMLDivElement;

	onMount(() => {
		setIcon(iconRef, props.name);
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
	state: Accessor<boolean>,
	setState: Setter<boolean>,
	class?: string,
}) {
	let iconRef!: HTMLDivElement;

	createEffect(() => {
		if (props.state()) {
			setIcon(iconRef, props.onIcon);
		} else {
			setIcon(iconRef, props.offIcon);
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
