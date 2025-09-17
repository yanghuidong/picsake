import { setIcon } from 'obsidian';
import { Accessor, createEffect, onMount, Setter } from 'solid-js';

export { IconButton, IconToggle };

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

	return (
		<div ref={iconRef}
			class={props.class ? `${props.class} iconButton flex-center` : 'iconButton flex-center'}
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
}) {
	let iconRef!: HTMLDivElement;

	createEffect(() => {
		if (props.state()) {
			setIcon(iconRef, props.onIcon);
		} else {
			setIcon(iconRef, props.offIcon);
		}
	});

	return (
		<div ref={iconRef}
			class="flex-center"
			onClick={() => {
				props.setState(prev => !prev);
			}}
		/>
	);
}