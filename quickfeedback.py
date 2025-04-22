import pandas as pd

df = pd.read_csv('feeds.csv')

# 1) Basic shape and columns
print("Initial shape:", df.shape)
print("Columns:", df.columns)

# 2) Peek at data
print(df.head())

# 3) Check for nulls
print("Null count per column:")
print(df.isnull().sum())
