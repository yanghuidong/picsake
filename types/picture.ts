import { TFile } from 'obsidian';

export type { Picture, PicturesByPath };

type Picture = {
	url: string,
	description: string,
	file: TFile,
};

type PicturesByPath = { [key: string]: Picture[] };