#!/bin/bash

__~bootstrap:package{cd scss && cp __bootstrap:package__-package.json package.json && npm install && npm run css}
