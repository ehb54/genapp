#!/bin/bash

__!bootstrap:forcemake{echo use directives:bootstrap:forcemake to make scss && exit}
__~bootstrap:package{cd scss && cp __bootstrap:package__-package.json package.json && npm install && npm run css}
