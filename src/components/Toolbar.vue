<template>
	<div class="toolbar">
		<!-- Select object/default option -->
		<div
			:class="['toolbar-tool', { active: toolActive === 'select' }]"
			title="select"
			@click="onToolSelect"
		>
			<img src="@/assets/tool-select.svg" alt="select" />
		</div>
		<!-- Add object -->
		<div
			:class="['toolbar-tool', { active: toolActive === 'addObject' }]"
			title="add box"
			@click="onToolAddObject"
		>
			<img src="@/assets/tool-cube.svg" alt="cube" />
		</div>
		<!-- Translate -->
		<div
			:class="[
				'toolbar-tool',
				{ active: toolActionActive === 'translate' },
				{ disabled: !hasSelectedObject },
			]"
			title="translate"
			@click="onToolTranslate"
		>
			<img src="@/assets/tool-translate.svg" alt="translate" />
		</div>
		<!-- Rotate -->
		<div
			:class="[
				'toolbar-tool',
				{ active: toolActionActive === 'rotate' },
				{ disabled: !hasSelectedObject },
			]"
			title="rotate"
			@click="onToolRotate"
		>
			<img src="@/assets/tool-rotate.svg" alt="rotate" />
		</div>
		<!-- Scale -->
		<div
			:class="[
				'toolbar-tool',
				{ active: toolActionActive === 'scale' },
				{ disabled: !hasSelectedObject },
			]"
			title="scale"
			@click="onToolScale"
		>
			<img src="@/assets/tool-scale.svg" alt="scale" />
		</div>
		<!-- Delete -->
		<div
			:class="['toolbar-tool', { disabled: !hasSelectedObject }]"
			title="delete"
			@click="onToolDelete"
		>
			<img src="@/assets/tool-delete.svg" alt="delete" />
		</div>
	</div>
</template>

<script>
export default {
	name: "Toolbar",

	props: {
		hasSelectedObject: Boolean,
	},

	data() {
		return {
			toolActive: "select",
			toolActionActive: null,
		};
	},

	watch: {
		hasSelectedObject() {
			if (!this.hasSelectedObject) {
				this.toolActionActive = null;
			}
		},
	},

	mounted() {
		this.onToolSelect();
	},

	methods: {
		onToolSelect() {
			this.toolActive = "select";
			this.$emit("onToolSelect");
		},
		onToolAddObject() {
			this.toolActive = "addObject";
			this.$emit("onToolAddObject");
		},
		onToolTranslate() {
			this.toolActionActive = "translate";
			this.$emit("onToolTranslate");
		},
		onToolRotate() {
			this.toolActionActive = "rotate";
			this.$emit("onToolRotate");
		},
		onToolScale() {
			this.toolActionActive = "scale";
			this.$emit("onToolScale");
		},
		onToolDelete() {
			this.$emit("onToolDelete");
		},
	},
};
</script>

<style lang="scss" scoped>
.toolbar {
	position: absolute;
	left: 50%;
	bottom: 20px;
	transform: translateX(-50%);
	display: flex;
	background: #111;
	padding: 10px;
	justify-content: space-between;
	align-items: center;
	border-radius: 3px;
}

.toolbar-tool {
	width: 30px;
	height: 30px;
	display: flex;
	justify-content: center;
	align-items: center;
	margin-right: 10px;
	cursor: pointer;
	border: solid #fff 1px;
	background: #222;
	opacity: 0.8;
	padding: 5px;
	border-radius: 3px;
	transition:
		background 0.2s,
		opacity 0.2s;

	&:last-child {
		margin-right: 0px;
	}

	img {
		height: 20px;
		width: 20px;
		filter: invert(100%);
	}

	&:hover {
		opacity: 1;
		background: #f19e38;
	}

	&.active {
		opacity: 1;
		background: #f19e38;
	}

	&.disabled {
		pointer-events: none;
		opacity: 0.2;
	}
}
</style>
