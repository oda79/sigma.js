import type { Meta, StoryObj } from "@storybook/web-components";

import template from "./index.html?raw";
import nodeImagesPlay from "./node-images";
import nodeImagesSource from "./node-images?raw";
const meta: Meta = {
  id: "node-image-border",
  title: "node-image-border",
};
export default meta;

type Story = StoryObj;

export const nodeImages: Story = {
  name: "NodeImageRenderer",
  render: () => template,
  play: nodeImagesPlay,
  args: {},
  parameters: {
    storySource: {
      source: nodeImagesSource,
    },
  },
};
