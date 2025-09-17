import { setIcon } from 'obsidian';
import { Accessor, onMount } from 'solid-js';

export { IconButton };

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
			class={props.class ? `iconButton ${props.class}` : 'iconButton'}
			classList={{ 'enabled': props.enabled(), ...props.classList }}
			onClick={(evt) => {
				if (props.enabled()) {
					props.onClick(evt);
				}
			}}
		/>
	);
}