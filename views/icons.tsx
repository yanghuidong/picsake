import { setIcon } from 'obsidian';
import { Accessor, onMount } from 'solid-js';

export { IconButton };

function IconButton(props: {
	name: 'undo-2'
	enabled: Accessor<boolean>
	onClick: (evt: MouseEvent) => void
}) {
	let iconRef!: HTMLDivElement;

	onMount(() => {
		setIcon(iconRef, props.name);
	});

	return (
		<div ref={iconRef}
			class="iconButton"
			classList={{ 'enabled': props.enabled() }}
			onClick={(evt) => props.onClick(evt)}
		/>
	);
}