#! /bin/bash

set -e

XUL_RUNNER_BIN=../xulrunner

sed s/%build%/$(uuidgen)/ application.ini.in > application.ini
$XUL_RUNNER_BIN application.ini
