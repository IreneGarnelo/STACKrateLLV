# import necessary library
import csv
import numpy as np

# set necessary parameters
ex_id = 1                   # Exercise ID
text_file = "responses.csv" # Name of csv with STACK-data
pos_survey = 6 # num of col -1

# First pass of the file to determine unique IDs for students
names = []
includes_survey = []
with open(text_file, newline='') as csvfile:
    rreader = csv.reader(csvfile)
    inc = False
    for row in rreader:
        if(inc):
            names.append(row[0]+row[1])
        inc=True

names = np.unique(names).tolist()



# Second pass: store relevant data in list

lines = []
with open(text_file, newline='') as csvfile:
    rreader = csv.reader(csvfile)
    inc = False
    for row in rreader:
        if(inc):
            rest = row[8].split(";")
            if (len(rest) > pos_survey):
                if ("ratings" in rest[pos_survey]):
                    rating = rest[pos_survey]
                    stars = rating[rating.find("ratings")+11 : rating.find("comment")-4].split(",")
                    comment = rating[rating.find("comment")+12:]
                    comment = comment[:comment.find("submitted")-5]
                    if (comment == ""):
                        comment = "LEER"
                    newline = [names.index(row[0]+row[1]), ex_id, row[7], rest[3]] + stars + [comment]
                    lines.append(newline)
        inc=True

# Write data from list into new csv
with open('results.csv', 'w', newline='') as csvfile:
    rwriter = csv.writer(csvfile, delimiter=';')
    rwriter.writerow(["User ID", "Aufgabe ID", "Score", "Feedbackbaum", "Kat1", "Kat2", "Kat3", "Kat4", "Text"])
    for i in range(len(lines)):
        rwriter.writerow(lines[i]) 

