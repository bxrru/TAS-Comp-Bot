#!/bin/bash

stty cols 130 rows 30
clear

while :
do
echo "Starting bot..."
node "./bot-files/main.js" > ./error_log.txt
read -n1 -r -p "Press any key to restart bot..."
done